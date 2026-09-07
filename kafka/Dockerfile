# Kafka (KRaft, single node) for 32-bit ARM — Raspberry Pi 2, DietPi
# Built on eclipse-temurin:17-jre-jammy, one of the few JVM images that still
# publishes a linux/arm/v7 variant. Docker resolves that variant automatically
# when this is built on the Pi itself.

FROM eclipse-temurin:17-jre-jammy

ARG KAFKA_VERSION=4.3.1
ARG SCALA_VERSION=2.13

ENV KAFKA_HOME=/opt/kafka

RUN apt-get update && \
    apt-get install -y --no-install-recommends wget ca-certificates netcat-openbsd && \
    wget -q "https://downloads.apache.org/kafka/${KAFKA_VERSION}/kafka_${SCALA_VERSION}-${KAFKA_VERSION}.tgz" -O /tmp/kafka.tgz && \
    mkdir -p "${KAFKA_HOME}" && \
    tar -xzf /tmp/kafka.tgz -C "${KAFKA_HOME}" --strip-components=1 && \
    rm /tmp/kafka.tgz && \
    apt-get purge -y wget && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r kafka && useradd -r -g kafka -d "${KAFKA_HOME}" kafka && \
    mkdir -p /var/lib/kafka/data

COPY server.properties "${KAFKA_HOME}/config/kraft/server.properties"
COPY entrypoint.sh /entrypoint.sh

# chown runs LAST, after both COPY steps, so it's the final word on
# ownership — COPY without --chown defaults new files to root, which
# would otherwise block the kafka user from writing here at runtime.
RUN chmod +x /entrypoint.sh && \
    chown -R kafka:kafka "${KAFKA_HOME}" /var/lib/kafka

USER kafka
WORKDIR ${KAFKA_HOME}

EXPOSE 9092 9093 9094

ENTRYPOINT ["/entrypoint.sh"]