declare module "heic2any" {
  interface HeicToAnyOptions {
    blob: Blob;
    toType?: string;
    quality?: number;
    gifInterval?: number;
  }
  function heic2any(options: HeicToAnyOptions): Promise<Blob | Blob[]>;
  export default heic2any;
}
