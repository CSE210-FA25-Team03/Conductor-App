server {
    listen 80;
    server_name conductor.bobbyzhu.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name conductor.bobbyzhu.com;

    ssl_certificate     /etc/letsencrypt/live/conductor.bobbyzhu.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/conductor.bobbyzhu.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
