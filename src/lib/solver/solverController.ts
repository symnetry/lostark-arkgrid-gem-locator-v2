import { ArkGridAttrs } from '../constants/enums';
import {
  type ArkGridCoreCoeffs,
  ArkGridCoreTypes,
  getDefaultCoreEnergy,
} from '../models/arkGridCores';
import type { CharacterProfile } from '../state/profile.state.svelte';
import type {
  SolverProgress,
  SolverRunPayload,
  SolverRunResult,
  SolverWorkerRequest,
  SolverWorkerResponse,
  WorkerCore,
} from './types';

function buildCoreArray(coeffs: ArkGridCoreCoeffs): number[] {
  const arr = new Array(21).fill(0);
  arr.fill(coeffs.p10, 10, 14);
  arr.fill(coeffs.p14, 14, 17);
  arr[17] = coeffs.p17;
  arr[18] = coeffs.p18;
  arr[19] = coeffs.p19;
  arr[20] = coeffs.p20;
  return arr;
}

function buildSolverCores(
  profile: CharacterProfile
): Pick<SolverRunPayload, 'orderCores' | 'chaosCores'> {
  const orderCores: WorkerCore[] = [];
  const chaosCores: WorkerCore[] = [];

  for (const attr of Object.values(ArkGridAttrs)) {
    for (const ctype of Object.values(ArkGridCoreTypes)) {
      const core = profile.cores[attr][ctype];
      const targetCores = attr === '질서' ? orderCores : chaosCores;

      if (!core) {
        targetCores.push({
          energy: 0,
          point: 0,
          coeff: [0],
        });
        continue;
      }

      targetCores.push({
        energy: getDefaultCoreEnergy(core),
        point: core.goalPoint,
        coeff: buildCoreArray(core.coeffs),
      });
    }
  }

  return { orderCores, chaosCores };
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type Deferred = {
  resolve: (result: SolverRunResult) => void;
  reject: (reason?: unknown) => void;
};

export class SolverController {
  private state: 'idle' | 'running' = 'idle';
  private worker: Worker;
  private pending: Deferred | null = null;
  onProgress: ((progress: SolverProgress) => void) | null = null;

  constructor() {
    this.worker = new Worker(new URL('./solverWorker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<SolverWorkerResponse>) => {
      this.handleWorkerMessage(e);
    };
    this.worker.onerror = (e) => {
      this.handleWorkerError(e);
    };
  }

  private postMessage(msg: SolverWorkerRequest) {
    this.worker.postMessage(msg);
  }

  private settlePending(settler: (pending: Deferred) => void) {
    const pending = this.pending;
    this.pending = null;
    this.state = 'idle';
    if (pending) {
      settler(pending);
    }
  }

  private handleWorkerMessage(e: MessageEvent<SolverWorkerResponse>) {
    const data = e.data;

    switch (data.type) {
      case 'runSolve:progress':
        this.onProgress?.(data.progress);
        break;
      case 'runSolve:done':
        this.settlePending((pending) => {
          pending.resolve(data.result);
        });
        break;
      case 'runSolve:error':
        this.settlePending((pending) => {
          pending.reject(new Error(data.message));
        });
        break;
    }
  }

  private handleWorkerError(error: ErrorEvent) {
    this.settlePending((pending) => {
      pending.reject(error.error ?? new Error(error.message));
    });
  }

  runSolve(profile: CharacterProfile) {
    if (this.state === 'running') {
      throw new Error('busy');
    }

    const { orderCores, chaosCores } = buildSolverCores(profile);
    const payload: SolverRunPayload = {
      orderCores,
      chaosCores,
      orderGems: toPlain(profile.gems.orderGems),
      chaosGems: toPlain(profile.gems.chaosGems),
      isSupporter: profile.isSupporter,
    };

    this.state = 'running';
    return new Promise<SolverRunResult>((resolve, reject) => {
      this.pending = { resolve, reject };
      try {
        this.postMessage({
          type: 'runSolve',
          payload,
        });
      } catch (error) {
        this.settlePending((pending) => {
          pending.reject(error);
        });
      }
    });
  }

  destroy() {
    this.settlePending((pending) => {
      pending.reject(new Error('solver controller disposed'));
    });
    this.worker.terminate();
  }
}
