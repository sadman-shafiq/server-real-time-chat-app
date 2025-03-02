wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc

echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -c | awk '{print $2}')-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update -y && sudo apt upgrade -y 

sudo apt install postgresql

# verify status
sudo systemctl status postgresql

# start psql
sudo systemctl start postgresql

# enable psql on boot
sudo systemctl enable postgresql
