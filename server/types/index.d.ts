declare module 'node-imap' {
  import { EventEmitter } from 'events';
  
  interface ImapOptions {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
    tlsOptions?: {
      rejectUnauthorized?: boolean;
    };
    connTimeout?: number;
    authTimeout?: number;
    debug?: (info: string) => void;
    autotls?: 'always' | 'required' | 'never';
    keepalive?: boolean;
    socketTimeout?: number;
  }

  interface ImapFetch extends EventEmitter {
    on(event: 'message', listener: (msg: ImapMessage, seqno: number) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: 'end', listener: () => void): this;
  }

  interface ImapMessage extends EventEmitter {
    on(event: 'body', listener: (stream: NodeJS.ReadableStream, info: any) => void): this;
    once(event: 'attributes', listener: (attrs: any) => void): this;
    once(event: 'end', listener: () => void): this;
  }

  interface ImapMailbox {
    flags: string[];
    exists: number;
    newMessages: number;
    uidnext: number;
    uidvalidity: number;
  }

  class Connection extends EventEmitter {
    constructor(options: ImapOptions);
    connect(): void;
    openBox(mailboxName: string, readOnly: boolean, callback: (err: Error | null, mailbox: ImapMailbox) => void): void;
    search(criteria: any[], callback: (err: Error | null, results: number[]) => void): void;
    fetch(source: any, options: any): ImapFetch;
    end(): void;
    once(event: 'ready', listener: () => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: 'end', listener: () => void): this;
    
    static parseHeader(headerText: string): {[key: string]: string | string[]};
  }

  export default Connection;
}