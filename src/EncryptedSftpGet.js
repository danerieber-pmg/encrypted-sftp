import Client from 'ssh2-sftp-client';
import * as openpgp from 'openpgp';
import fs from 'fs';

export default class EncryptedSftpGet {
  constructor(encryptedSftp, remotePath, localPath) {
    this.encryptedSftp = encryptedSftp;
    this.remotePath = remotePath;
    this.localPath = localPath;
  }

  then(resolve, reject) {
    this.run().then(resolve, reject);
  }

  async run() {
    const client = new Client('alli-client');
    await client.connect(this.encryptedSftp.config);
    await client.fastGet(this.remotePath, this.localPath);
    await client.end();

    if (!this.decrypt) return;

    const encoding = this.armored ? 'utf8' : null;
    const encrypted = fs.createReadStream(this.localPath, { encoding });
    const decrypted = fs.createWriteStream(this.decryptedPath);

    const message = this.armored
      ? await openpgp.readMessage({ armoredMessage: encrypted })
      : await openpgp.createMessage({ binary: encrypted });

    const { data } = await openpgp.decrypt({
      message,
      verificationKeys: this.encryptedSftp.publicKey,
      decryptionKeys: this.encryptedSftp.privateKey,
    });
    data.pipe(decrypted);

    decrypted.on('close', () => fs.unlinkSync(this.localPath));
  }

  decrypt(decryptedPath) {
    this.decrypt = true;
    this.decryptedPath = decryptedPath;
    return this;
  }

  armored() {
    this.armored = true;
    return this;
  }
}
