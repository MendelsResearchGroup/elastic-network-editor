declare module "*.js" {
  const createModule: (opts?: Record<string, unknown>) => unknown;
  export default createModule;
}
