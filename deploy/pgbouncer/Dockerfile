FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbouncer ca-certificates gettext-base netcat-openbsd \
    && groupadd --system pgbouncer \
    && useradd --system --gid pgbouncer --home-dir /var/lib/pgbouncer --create-home pgbouncer \
    && mkdir -p /etc/pgbouncer /var/run/pgbouncer \
    && chown -R pgbouncer:pgbouncer /etc/pgbouncer /var/run/pgbouncer /var/lib/pgbouncer \
    && rm -rf /var/lib/apt/lists/*

COPY deploy/pgbouncer/pgbouncer.ini.tmpl /etc/pgbouncer/pgbouncer.ini.tmpl
COPY deploy/pgbouncer/userlist.txt.tmpl /etc/pgbouncer/userlist.txt.tmpl
COPY deploy/pgbouncer/entrypoint.sh /usr/local/bin/pgbouncer-entrypoint.sh

RUN chmod +x /usr/local/bin/pgbouncer-entrypoint.sh \
    && chown pgbouncer:pgbouncer /etc/pgbouncer/pgbouncer.ini.tmpl /etc/pgbouncer/userlist.txt.tmpl /usr/local/bin/pgbouncer-entrypoint.sh

EXPOSE 6432

USER pgbouncer

ENTRYPOINT ["/usr/local/bin/pgbouncer-entrypoint.sh"]

CMD ["pgbouncer", "/etc/pgbouncer/pgbouncer.ini"]
