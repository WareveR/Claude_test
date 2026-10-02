// Prints a new VAPID key pair for Web Push Reminders (docs/runbooks/reminders.md).
import { Buffer } from "node:buffer";
import console from "node:console";
const { subtle } = globalThis.crypto;
const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const publicKey = Buffer.from(await subtle.exportKey("raw", pair.publicKey)).toString("base64url");
const { d } = await subtle.exportKey("jwk", pair.privateKey);
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
