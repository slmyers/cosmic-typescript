export interface IOrderLine {
    orderId: string;
    sku: string;
    qty: number;
}

export class OrderLine {
    constructor(
        public orderId: string,
        public sku: string,
        public qty: number
    ) { 
        Object.freeze(this);
    }

    toString(): string {
        return `OrderLine(${this.orderId}, ${this.sku}, ${this.qty})`;
    }
}

export interface IBatch {
    reference: string;
    sku: string;
    available_quantity: number;
    eta: Date;

    allocate(line: OrderLine): Batch;
    can_allocate(line: OrderLine): boolean;
    deallocate(line: OrderLine): Batch;
    __eq__(other: Batch): boolean;
    __hash__(): string;
}


export class Batch {
    private allocated: Map<string, OrderLine> = new Map();
    private _available_quantity: number;

    constructor(
        public reference: string,
        public sku: string,
        available_quantity: number,
        public eta: Date
    ) { 
        this._available_quantity = available_quantity;
    }

    get available_quantity(): number {
        return [...this.allocated.values()]
            .reduce((acc, line) => acc - line.qty, this._available_quantity);
    }

    allocate(line: OrderLine): Batch {
        if (this.can_allocate(line)) {
            this.allocated.set(line.orderId, line);
        }
        return this;
    }

    can_allocate(line: OrderLine): boolean {
        return this.sku === line.sku && this.available_quantity >= line.qty;
    }

    deallocate(line: OrderLine): Batch {
        if (this.allocated.has(line.orderId)) {
            this.allocated.delete(line.orderId);
        }
        return this;
    }

    __eq__(other: Batch): boolean {
        if (!(other instanceof Batch)) {
            return false;
        }
        return other.reference === this.reference;
    }

    __hash__(): string {
        return this.toString();
    }

    toString(): string {
        return [
            this.reference,
            this.sku,
        ].join(':');
    }
}

export function allocate(batches: IBatch[], order: OrderLine): string {
    const batch = batches.find(b => b.can_allocate(order));
    if (batch) {
        batch.allocate(order);
        return batch.reference;
    }
    throw new OutOfStockError(order.sku);
}

export class OutOfStockError extends Error {
    constructor(public readonly sku: string) {
        super(`Out of stock for sku ${sku}`);
    }
}