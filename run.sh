#! /bin/sh
lighttpd -f lighttpd.conf

firefox http://127.0.0.1:3000/index.html

lighttpd stop
