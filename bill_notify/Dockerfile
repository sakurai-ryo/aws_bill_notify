FROM rust:1.87.0-slim AS builder

ARG APP_NAME=bill_notify
ARG BUILDDIR=/app
WORKDIR ${BUILDDIR}

RUN apt -y update
RUN apt -y upgrade
RUN apt -y install pkg-config libssl-dev

RUN --mount=type=bind,source=src,target=src \
    --mount=type=bind,source=Cargo.toml,target=Cargo.toml \
    --mount=type=bind,source=Cargo.lock,target=Cargo.lock \
    --mount=type=cache,target=${BUILDDIR}/target/ \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    <<EOF
set -eu
cargo build --locked --release
cp ./target/release/${APP_NAME} /${BUILDDIR}/main
EOF

FROM public.ecr.aws/lambda/provided:al2023

WORKDIR /app

COPY --from=builder /app/main /app/main

ENTRYPOINT [ "/app/main" ]
