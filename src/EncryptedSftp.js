import fs from 'fs';
import * as openpgp from 'openpgp';
import Client from 'ssh2-sftp-client';

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
    const encryptedPath = `${localPath}.pgp`;

    // Download from SFTP
    const client = new Client('alli-client');
    await client.connect(this.config);
    await client.fastGet(remotePath, encryptedPath);
    await client.end();

    // Create file Streams
    const encryptedFile = fs.createReadStream(encryptedPath, { encoding });
    const file = fs.createWriteStream(localPath, { encoding });

    // Decrypt encryptedFile and pipe into file
    const message = await openpgp.readMessage({ armoredMessage: encryptedFile });
    const { data: decrypted } = await openpgp.decrypt({
      message,
      verificationKeys: this.publicKey,
      decryptionKeys: this.privateKey,
    });
    decrypted.pipe(file);
  }

  // Encrypt a file and upload it
  async put(localPath, remotePath) {
    await this.readKeys();
    const encryptedPath = `${localPath}.pgp`;

    // Create file Streams
    const file = fs.createReadStream(localPath, { encoding });
    const encryptedFile = fs.createWriteStream(encryptedPath, { encoding });

    // Encrypt file and pipe into encryptedFile
    const message = await openpgp.createMessage({ text: file });
    const encrypted = await openpgp.encrypt({
      message,
      encryptionKeys: this.publicKey,
      signingKeys: this.privateKey,
    });
    encrypted.pipe(encryptedFile);

    // Upload to SFTP
    const client = new Client('alli-client');
    await client.connect(this.config);
    await client.fastPut(encryptedPath, remotePath);
    await client.end();
  }
}
