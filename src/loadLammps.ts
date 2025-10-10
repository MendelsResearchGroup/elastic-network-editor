// export async function loadLammps(onPrint: (s: string) => void) {
//   const mjsUrl  = (await import("/wasm/lammps.js?url")).default as string;
//   const wasmUrl = (await import("/wasm/lammps.wasm?url")).default as string;

//   const mod = await import(/* @vite-ignore */ mjsUrl);
//   const createModule = (mod as any).default ?? (mod as any).createModule;

//   const Module = await createModule({
//     print: onPrint,
//     printErr: onPrint,
//     locateFile: (p: string) => (p.endsWith(".wasm") ? wasmUrl : p),
//   });
//   return Module; // new Module.LAMMPSWeb()
// }