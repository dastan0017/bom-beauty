declare module 'heic-decode' {
  interface DecodedImage {
    width: number;
    height: number;
    /** RGBA pixels. */
    data: Uint8ClampedArray;
  }
  function decode(input: { buffer: ArrayBufferLike | Uint8Array }): Promise<DecodedImage>;
  export default decode;
}
