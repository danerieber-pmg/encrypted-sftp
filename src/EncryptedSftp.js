import fs from 'fs';
import * as openpgp from 'openpgp';
import Client from 'ssh2-sftp-client';
import { withFile } from 'tmp-promise';

// All encryption is armored and requires utf8 encoding
const encoding = 'utf8';

// SFTP server with automatic PGP encryption
export default class EncryptedSftp {
  constructor({
    host, username, password, publicKeyArmored, privateKeyArmored,
  }) {
    this.config = { host, username, password };
    this.publicKeyArmored = publicKeyArmored;
    this.privateKeyArmored = privateKeyArmored;
  }

  // Lazy load public and private keys
  async readKeys() {
    if (this.publicKey && this.privateKey) return;
    this.publicKey = await openpgp.readKey({ armoredKey: this.publicKeyArmored });
    this.privateKey = await openpgp.readPrivateKey({ armoredKey: this.privateKeyArmored });
  }

  // Download a file and decrypt it
  async get(remotePath, localPath) {
    await this.readKeys();

    // Create temporary file to write encrypted data
    return withFile(async ({ path }) => {
      // Download from SFTP
      const client = new Client('alli-client');
      await client.connect(this.config);
      await client.fastGet(remotePath, path);
      await client.end();

      // Create file Streams
      const encryptedFile = fs.createReadStream(path, { encoding });
      const outFile = fs.createWriteStream(localPath, { encoding });

      // Decrypt encryptedFile and pipe into outFile
      const message = await openpgp.readMessage({ armoredMessage: encryptedFile });
      const { data: decrypted } = await openpgp.decrypt({
        message,
        verificationKeys: this.publicKey,
        decryptionKeys: this.privateKey,
      });
      decrypted.pipe(outFile);
    });
  }

  // Encrypt a file and upload it
  async put(localPath, remotePath) {
    await this.readKeys();

    // Create temporary file to write encrypted data
    return withFile(async ({ path }) => {
      // Create file Streams
      const inFile = fs.createReadStream(localPath, { encoding });
      const encryptedFile = fs.createWriteStream(path, { encoding });

      // Encrypt inFile and pipe into encryptedFile
      const message = await openpgp.createMessage({ text: inFile });
      const encrypted = await openpgp.encrypt({
        message,
        encryptionKeys: this.publicKey,
        signingKeys: this.privateKey,
      });
      encrypted.pipe(encryptedFile);

      // Upload to SFTP
      const client = new Client('alli-client');
      await client.connect(this.config);
      await client.fastPut(path, remotePath);
      await client.end();
    });
  }
}
