FROM rust:1.82.0-slim as builder

WORKDIR /app

COPY Cargo.toml .
COPY Cargo.lock .
COPY src src

RUN --mount=type=bind,source=src,target=src \
    --mount=type=bind,source=Cargo.toml,target=Cargo.toml \
    --mount=type=bind,source=Cargo.lock,target=Cargo.lock \
    --mount=type=cache,target=${BUILDDIR}/target/ \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    cargo build --release

RUN strip target/release/bill-notify -o main

FROM public.ecr.aws/lambda/provided:al2.2024.10.30.15

WORKDIR /app

COPY --from=builder /app/main /app/main

ENTRYPOINT [ "/app/main" ]
