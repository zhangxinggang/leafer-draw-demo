const webWorker = window.Worker;

type IFunc = (e: MessageEvent) => void;
type IInput = string | URL | IFunc;
type ISource = IInput | IInput[];
interface IInitProps {
  maxWorkerNum: number; // 最大线程数量，默认3
}
interface IUserData {
  src: ISource;
  data?: Record<string, any>;
  beforeWorker?: (worker: Worker) => void; // 传递beforeWorker，返回worker实例由业务处理是否销毁，未传递beforeWorker运行完直接销毁
  workerOptions?: WorkerOptions;
}
interface IWorkerQueue {
  jobId: number;
  params: IUserData;
}

type ISplitSource = { funcs: IInput[]; strs: string[] };

const typeReflect = {
  function: '[object Function]',
  array: '[object Array]',
  string: '[object String]',
};

const initWorker = function (src: ISource, options: WorkerOptions): Worker {
  const type = Object.prototype.toString.call(src);
  let blobUrl = '';
  let wk = null;
  const getBlobUrl = ({ funcs, strs }: ISplitSource) => {
    const supportType = { type: 'text/javascript' };
    const functions = funcs.map((item) => {
      return `
        onmessage = (message) => {
          (${item.toString().trim()})(message)
        }
      `;
    });
    const excutes = [...functions, ...strs];
    const blobScript = new Blob(excutes, supportType);
    const url = URL.createObjectURL(blobScript);
    blobUrl = url;
    return url;
  };
  const wrapWorker = () => {
    if ([typeReflect.array, typeReflect.function].includes(type)) {
      const inputs = type === typeReflect.array ? src : [src];
      const sourceObj: ISplitSource = {
        funcs: [],
        strs: [],
      };
      (inputs as IInput[]).forEach((item) => {
        const srcType = Object.prototype.toString.call(item);
        if ([typeReflect.function].includes(srcType)) {
          sourceObj.funcs.push(item);
        } else if ([typeReflect.string].includes(srcType)) {
          sourceObj.strs.push(item as string);
        } else {
          console.warn('worker中函数数组参数只允许传递字符串或者函数');
        }
      });
      const url = getBlobUrl(sourceObj);
      wk = new webWorker(url, options);
    } else {
      wk = new webWorker(src as string | URL, options);
    }
  };
  wrapWorker();
  blobUrl && URL.revokeObjectURL(blobUrl);
  return wk;
};
const cbId = {};
const workerQueue: IWorkerQueue[] = [];
const uuid = (function () {
  let idcount = 1;
  return function () {
    return idcount++;
  };
})();
let initWorkerOptions = {
  maxWorkerNum: 3,
};
let workerNum = 0;
const exceQueueJob = () => {
  if (workerNum < initWorkerOptions.maxWorkerNum && workerQueue.length) {
    let { jobId, params } = workerQueue.shift();
    let { src, data, workerOptions, beforeWorker } = params;
    let worker: Worker | null = null;
    workerNum++;
    try {
      worker = initWorker(src, workerOptions);
    } catch (error) {
      cbId[jobId].reject(error);
    }
    worker.onmessage = ({ data: data2 }) => {
      cbId[jobId].resolve(data2);
      if (!beforeWorker) {
        delete cbId[jobId];
        worker.terminate();
      }
      workerNum--;
      exceQueueJob();
    };
    worker.onerror = (error) => {
      cbId[jobId].reject(error);
      exceQueueJob();
    };
    if (beforeWorker) {
      beforeWorker(worker);
    } else {
      worker.postMessage(data);
    }
  }
};
const richWorker = {
  init: (options: IInitProps) => {
    Object.assign(initWorkerOptions, options || {});
  },
  open: (params: IUserData) => {
    const jobId = uuid();
    workerQueue.push({
      jobId,
      params,
    });
    return new Promise((resolve, reject) => {
      cbId[jobId] = { resolve, reject };
      exceQueueJob();
    });
  },
};

export { richWorker };