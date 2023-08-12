import { IProductEvent, ProductOutOfStockEventV1 } from './ProductEvent';

export interface IProduct {
    sku: string;
    description: string;
    batches: IBatch[];
    version: number;
    events: IProductEvent[];

    allocate(line: OrderLine): IProduct;
    canAllocate(line: OrderLine): boolean;
    deallocate(orderId: string): IProduct;
}

export class Product implements IProduct {
    events: IProductEvent[] = [];
    constructor(
        public sku: string,
        public description: string,
        public batches: IBatch[],
        public version: number
    ) {}

    allocate(line: OrderLine): Product {
        const batch = this.batches.find(b => b.canAllocate(line));
        if (batch) {
            batch.allocate(line);
            this.version += 1;
        } else {
            this.events.push(new ProductOutOfStockEventV1(this.sku));
        }

        return this;
    }

    canAllocate(line: OrderLine): boolean {
        return this.batches.some(b => b.canAllocate(line));
    }

    deallocate(orderId: string): Product {
        const batch = this.batches.find(b => b.allocatedOrders().some((l) => {
            return l.orderId === orderId;
        }));
        if (batch) {
            batch.deallocate(orderId);
            this.version += 1;
            return this;
        }
        throw new Error('Batch not found');
    }

    updateDescription(description: string): Product {
        this.description = description;
        this.version += 1;
        return this;
    }
}


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
    max_quantity: number;
    eta: Date;

    allocate(line: OrderLine): Batch;
    canAllocate(line: OrderLine): boolean;
    deallocate(orderId: string): Batch;
    allocatedOrders(): OrderLine[];
    __eq__(other: Batch): boolean;
    __hash__(): string;
}


export class Batch implements IBatch {
    protected allocated: Map<string, OrderLine> = new Map();
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

    get max_quantity(): number {
        return this._available_quantity;
    }

    allocate(line: OrderLine): Batch {
        if (this.canAllocate(line)) {
            this.allocated.set(line.orderId, line);
        } else {
            throw new Error('Cannot allocate');
        }
        return this;
    }

    canAllocate(line: OrderLine): boolean {
        return this.sku === line.sku && this.available_quantity >= line.qty;
    }

    deallocate(orderId: string): Batch {
        if (this.allocated.has(orderId)) {
            this.allocated.delete(orderId);
        }
        return this;
    }

    allocatedOrders(): OrderLine[] {
        return [...this.allocated.values()];
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
    const batch = batches.find(b => b.canAllocate(order));
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
