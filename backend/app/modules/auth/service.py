from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import secrets
from uuid import UUID


class AuthTokenError(ValueError):
    pass


@dataclass(frozen=True)
class AccessTokenPayload:
    user_id: UUID
    expires_at: datetime
    active_account_id: UUID | None = None


@dataclass(frozen=True)
class IssuedTokenPair:
    access_token: str
    refresh_token: str
    refresh_token_hash: str
    refresh_expires_at: datetime


@dataclass(frozen=True)
class IssuedPasswordResetToken:
    token: str
    token_hash: str
    expires_at: datetime


class AuthTokenService:
    def __init__(
        self,
        *,
        secret_key: str,
        access_ttl_minutes: int,
        refresh_ttl_days: int,
    ) -> None:
        self._secret_key = secret_key.encode('utf-8')
        self._access_ttl_minutes = access_ttl_minutes
        self._refresh_ttl_days = refresh_ttl_days

    def issue_token_pair(self, user_id: UUID, *, active_account_id: UUID | None = None) -> IssuedTokenPair:
        access_token = self.issue_access_token(user_id, active_account_id=active_account_id)
        refresh_token = secrets.token_urlsafe(48)
        refresh_token_hash = self.hash_refresh_token(refresh_token)
        refresh_expires_at = datetime.now(timezone.utc) + timedelta(days=self._refresh_ttl_days)
        return IssuedTokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            refresh_token_hash=refresh_token_hash,
            refresh_expires_at=refresh_expires_at,
        )

    def issue_access_token(self, user_id: UUID, *, active_account_id: UUID | None = None) -> str:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=self._access_ttl_minutes)
        payload = {
            'sub': str(user_id),
            'type': 'access',
            'exp': int(expires_at.timestamp()),
        }
        if active_account_id is not None:
            payload['aid'] = str(active_account_id)
        encoded_payload = _b64encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
        signature = self._sign(encoded_payload)
        return f'{encoded_payload}.{signature}'

    def decode_access_token(self, token: str) -> AccessTokenPayload:
        try:
            encoded_payload, signature = token.split('.', 1)
        except ValueError as exc:
            raise AuthTokenError('Invalid access token format.') from exc

        expected_signature = self._sign(encoded_payload)
        if not hmac.compare_digest(signature, expected_signature):
            raise AuthTokenError('Invalid access token signature.')

        try:
            payload = json.loads(_b64decode(encoded_payload))
        except (json.JSONDecodeError, ValueError) as exc:
            raise AuthTokenError('Invalid access token payload.') from exc

        if payload.get('type') != 'access':
            raise AuthTokenError('Invalid access token type.')

        try:
            expires_at = datetime.fromtimestamp(int(payload['exp']), tz=timezone.utc)
            user_id = UUID(str(payload['sub']))
            active_account_id = UUID(str(payload['aid'])) if payload.get('aid') else None
        except (KeyError, TypeError, ValueError) as exc:
            raise AuthTokenError('Invalid access token claims.') from exc

        if expires_at <= datetime.now(timezone.utc):
            raise AuthTokenError('Access token expired.')

        return AccessTokenPayload(user_id=user_id, expires_at=expires_at, active_account_id=active_account_id)

    @staticmethod
    def hash_refresh_token(refresh_token: str) -> str:
        return hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()

    def _sign(self, encoded_payload: str) -> str:
        digest = hmac.new(self._secret_key, encoded_payload.encode('utf-8'), hashlib.sha256).digest()
        return _b64encode(digest)


class PasswordHasher:
    _ALGORITHM = 'scrypt'
    _N = 2**14
    _R = 8
    _P = 1
    _KEY_LEN = 64

    def hash_password(self, password: str) -> str:
        salt = secrets.token_bytes(16)
        derived_key = hashlib.scrypt(
            password.encode('utf-8'),
            salt=salt,
            n=self._N,
            r=self._R,
            p=self._P,
            dklen=self._KEY_LEN,
        )
        return '$'.join(
            (
                self._ALGORITHM,
                str(self._N),
                str(self._R),
                str(self._P),
                _b64encode(salt),
                _b64encode(derived_key),
            )
        )

    def verify_password(self, password: str, stored_hash: str) -> bool:
        try:
            algorithm, n_raw, r_raw, p_raw, salt_raw, key_raw = stored_hash.split('$', 5)
        except ValueError:
            return False

        if algorithm != self._ALGORITHM:
            return False

        try:
            derived_key = hashlib.scrypt(
                password.encode('utf-8'),
                salt=_b64decode(salt_raw),
                n=int(n_raw),
                r=int(r_raw),
                p=int(p_raw),
                dklen=len(_b64decode(key_raw)),
            )
        except (TypeError, ValueError):
            return False

        return hmac.compare_digest(_b64encode(derived_key), key_raw)


class PasswordResetService:
    def __init__(self, *, frontend_base_url: str, ttl_minutes: int) -> None:
        self._frontend_base_url = frontend_base_url.rstrip('/')
        self._ttl_minutes = ttl_minutes

    def issue_reset_token(self) -> IssuedPasswordResetToken:
        token = secrets.token_urlsafe(32)
        token_hash = self.hash_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=self._ttl_minutes)
        return IssuedPasswordResetToken(token=token, token_hash=token_hash, expires_at=expires_at)

    def build_reset_url(self, token: str) -> str:
        return f'{self._frontend_base_url}/reset-password?token={token}'

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode('utf-8').rstrip('=')


def _b64decode(value: str) -> bytes:
    padding = '=' * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
