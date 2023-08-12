export interface IProductEvent {
    sku: string;
    eventVersion: number;
    type: 'ProductOutOfStock' | 'ProductBatchCreated' | 'ProductAllocationRequred' | 'ProductDeallocationRequred';
}

export class ProductOutOfStockEventV1 implements IProductEvent {
    public readonly eventVersion: number;

    constructor(
        public readonly sku: string
    ) {
        this.eventVersion = 1;
        Object.freeze(this);
    }

    get type(): 'ProductOutOfStock' {
        return 'ProductOutOfStock';
    }
}

export class ProductBatchCreatedEventV1 implements IProductEvent {
    public readonly eventVersion: number;

    constructor(
        public readonly ref: string,
        public readonly sku: string,
        public readonly qty: number,
        public readonly eta: Date | null = null
    ) {
        this.eventVersion = 1;
        Object.freeze(this);
    }

    get type(): 'ProductBatchCreated' {
        return 'ProductBatchCreated';
    }
}

export class ProductAllocationRequredEventV1 implements IProductEvent {
    public readonly eventVersion: number;

    constructor(
        public readonly orderId: string,
        public readonly sku: string,
        public readonly qty: number
    ) {
        this.eventVersion = 1;
        Object.freeze(this);
    }

    get type(): 'ProductAllocationRequred' {
        return 'ProductAllocationRequred';
    }
}

export class ProductDeallocationRequredEventV1 implements IProductEvent {
    public readonly eventVersion: number;

    constructor(
        public readonly orderId: string,
        public readonly sku: string,
    ) {
        this.eventVersion = 1;
        Object.freeze(this);
    }

    get type(): 'ProductDeallocationRequred' {
        return 'ProductDeallocationRequred';
    }
}