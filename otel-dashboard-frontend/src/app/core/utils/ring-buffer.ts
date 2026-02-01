/**
 * A circular buffer that maintains a fixed capacity with O(1) insertion.
 * When full, oldest items are automatically overwritten.
 */
export class RingBuffer<T> {
    private buffer: (T | undefined)[];
    private head = 0;
    private tail = 0;
    private _size = 0;

    constructor(private capacity: number) {
        this.buffer = new Array(capacity);
    }

    /**
     * Add an item to the buffer. O(1) operation.
     */
    push(item: T): void {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.capacity;

        if (this._size < this.capacity) {
            this._size++;
        } else {
            this.tail = (this.tail + 1) % this.capacity;
        }
    }

    /**
     * Push multiple items efficiently.
     */
    pushMany(items: T[]): void {
        for (const item of items) {
            this.push(item);
        }
    }

    /**
     * Get all items as an array, newest first.
     */
    toArray(): T[] {
        const result: T[] = [];
        for (let i = 0; i < this._size; i++) {
            const index = (this.tail + this._size - 1 - i) % this.capacity;
            result.push(this.buffer[index] as T);
        }
        return result;
    }

    /**
     * Get items within a range for virtual scrolling.
     */
    getRange(start: number, count: number): T[] {
        const result: T[] = [];
        const actualStart = Math.max(0, start);
        const actualCount = Math.min(count, this._size - actualStart);

        for (let i = 0; i < actualCount; i++) {
            const index = (this.tail + this._size - 1 - actualStart - i) % this.capacity;
            result.push(this.buffer[index] as T);
        }
        return result;
    }

    get size(): number {
        return this._size;
    }

    get isFull(): boolean {
        return this._size === this.capacity;
    }

    clear(): void {
        this.buffer = new Array(this.capacity);
        this.head = 0;
        this.tail = 0;
        this._size = 0;
    }
}
