export class KafkaHealth {
  private available = false;

  isAvailable() {
    return this.available;
  }

  markUp() {
    this.available = true;
  }

  markDown() {
    this.available = false;
  }
}
