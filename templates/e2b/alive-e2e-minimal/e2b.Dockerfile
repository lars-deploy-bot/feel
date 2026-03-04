FROM e2bdev/base:latest

RUN mkdir -p /home/user/project
USER user

WORKDIR /home/user/project
