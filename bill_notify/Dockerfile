FROM rust:1.82.0-slim as builder

WORKDIR /app

RUN apt-get update && apt-get upgrade && apt-get install -y pkg-config libssl-dev

RUN --mount=type=bind,source=src,target=src \
    --mount=type=bind,source=Cargo.toml,target=Cargo.toml \
    --mount=type=bind,source=Cargo.lock,target=Cargo.lock \
    --mount=type=cache,target=${BUILDDIR}/target/ \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    cargo build --release

RUN strip target/release/bill_notify -o main

FROM public.ecr.aws/lambda/provided:al2023.2024.10.30.15

WORKDIR /app

COPY --from=builder /app/main /app/main

ENTRYPOINT [ "/app/main" ]
