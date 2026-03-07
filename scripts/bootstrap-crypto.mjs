import { secp256k1 } from "@noble/curves/secp256k1.js";
globalThis.__secp256k1_getSharedSecret = (priv, pub) => secp256k1.getSharedSecret(priv, pub);
