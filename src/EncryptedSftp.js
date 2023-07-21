import fs from 'fs';
import * as openpgp from 'openpgp';
import Client from 'ssh2-sftp-client';

const encoding = 'utf8';

export default class EncryptedSftp {
  constructor({
    host, username, password, publicKeyArmored, privateKeyArmored,
  }) {
    this.config = { host, username, password };
    this.publicKeyArmored = publicKeyArmored;
    this.privateKeyArmored = privateKeyArmored;
  }

  async readKeys() {
    if (this.publicKey && this.privateKey) return;
    this.publicKey = await openpgp.readKey({ armoredKey: this.publicKeyArmored });
    this.privateKey = await openpgp.readPrivateKey({ armoredKey: this.privateKeyArmored });
  }

  async get(remotePath, localPath) {
    await this.readKeys();
    const pgpPath = `${localPath}.pgp`;

    // Download from SFTP
    const client = new Client('alli-client');
    await client.connect(this.config);
    await client.fastGet(remotePath, pgpPath);
    await client.end();

    // Create file Streams
    const inFile = fs.createReadStream(pgpPath, { encoding });
    const outFile = fs.createWriteStream(localPath, { encoding });

    // Decrypt contents of inFile and pipe to outFile
    const message = await openpgp.readMessage({ armoredMessage: inFile });
    const { data } = await openpgp.decrypt({
      message,
      verificationKeys: this.publicKey,
      decryptionKeys: this.privateKey,
    });
    data.pipe(outFile);
  }

  async put(localPath, remotePath) {
    await this.readKeys();
    const pgpPath = `${localPath}.pgp`;

    // Create file Streams
    const inFile = fs.createReadStream(localPath, { encoding });
    const outFile = fs.createWriteStream(pgpPath, { encoding });

    // Encrypt contents of inFile and pipe to outFile
    const message = await openpgp.createMessage({ text: inFile });
    const data = await openpgp.encrypt({
      message,
      encryptionKeys: this.publicKey,
      signingKeys: this.privateKey,
    });
    data.pipe(outFile);

    // Upload to SFTP
    const client = new Client('alli-client');
    await client.connect(this.config);
    await client.fastPut(pgpPath, remotePath);
    await client.end();
  }
}
