sudo apt update && sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
sudo nano /etc/nginx/sites-available/api2.shalish.xyz

# Add the following content to the file
# server {
#     listen 80;
#     server_name ap2.shalish.xyz;

#     location / {
#         proxy_pass http://0.0.0.0:11010;
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#     }
# }

# server {
#     listen 443 ssl;
#     server_name ap2.shalish.xyz;

#     ssl_certificate /etc/letsencrypt/live/api2.shalish.xyz/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/api2.shalish.xyz/privkey.pem;

#     location / {
#         proxy_pass http://0.0.0.0:11010;
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#     }
# }

sudo ln -s /etc/nginx/sites-available/api2.shalish.xyz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api2.shalish.xyz
sudo certbot renew --dry-run
sudo systemctl restart nginx


# Install Node.js and NPM, and PM2
sudo apt update
sudo apt install nodejs
sudo apt install npm
sudo npm install -g npm
sudo npm install -g pm2
sudo pm2 startup
# cd to project directory
pm2 start pm2.config.js 

# sudo pm2 start /home/ubuntu/parentscare-backend-elysia/backend-elysia/index.js
