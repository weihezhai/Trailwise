import { stdin, stdout } from "node:process";

export interface NativeMessage {
  kind: string;
  session_id?: string;
  event?: Record<string, unknown>;
  extension_version?: string;
  tab_id?: number;
  frame_id?: number;
}

export async function* readNativeMessages(): AsyncGenerator<NativeMessage> {
  let buffer = Buffer.alloc(0);
  for await (const chunk of stdin) {
    buffer = Buffer.concat([buffer, chunk as Buffer]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (buffer.length < 4 + length) break;
      const payload = buffer.subarray(4, 4 + length);
      buffer = buffer.subarray(4 + length);
      yield JSON.parse(payload.toString("utf8")) as NativeMessage;
    }
  }
}

export function writeNativeMessage(message: Record<string, unknown>): void {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  stdout.write(header);
  stdout.write(payload);
}
