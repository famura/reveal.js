#! /bin/sh

# Creat alocal server using the local config file
lighttpd -f lighttpd.conf

# Launch the presentation in the default browser
xdg-open http://127.0.0.1:3000/index.html
