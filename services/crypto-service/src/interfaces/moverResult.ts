import { MoverData } from "./moverData";

export type MoverResult =
    | {
        status: 'success';
        source: 'cache' | 'api';
        data: MoverData[];
        timestamp: number;
    }
    | {
        status: 'unavailable';
        reason: 'circuit_open' | 'timeout' | 'api_error';
        timestamp: number;
    };
