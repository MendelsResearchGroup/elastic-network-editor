declare module "*.js" {
  const createModule: (opts?: any) => Promise<any> | any;
  export default createModule;
}
