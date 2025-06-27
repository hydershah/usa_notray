declare module 'fabric' {
  export namespace fabric {
    interface IObjectOptions {
      id?: string;
      [key: string]: any;
    }

    class Object {
      id?: string;
      left?: number;
      top?: number;
      width?: number;
      height?: number;
      scaleX?: number;
      scaleY?: number;
      [key: string]: any;
    }

    class Canvas {
      constructor(element: string | HTMLCanvasElement, options?: any);
      add(...objects: Object[]): Canvas;
      remove(...objects: Object[]): Canvas;
      clear(): Canvas;
      getObjects(): Object[];
      setDimensions(dimensions: { width: number; height: number }): Canvas;
      on(event: string, handler: Function): void;
      renderAll(): Canvas;
      dispose(): void;
    }

    class Text extends Object {
      constructor(text: string, options?: IObjectOptions);
    }

    class Image extends Object {
      static fromURL(url: string, callback: (img: Image) => void, imgOptions?: IObjectOptions): void;
    }

    class Rect extends Object {
      constructor(options?: IObjectOptions);
    }

    class Group extends Object {
      constructor(objects: Object[], options?: IObjectOptions);
    }
  }

  export const fabric: any;
} 