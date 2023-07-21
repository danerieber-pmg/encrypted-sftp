import * as openpgp from 'openpgp';
import EncryptedSftpGet from './EncryptedSftpGet.js';

export default class EncryptedSftp {
  constructor(config) {
    this.config = config;
  }

  async setKeys(publicKeyArmored, privateKeyArmored) {
    this.publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
    this.privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  }

  get(remotePath, localPath) {
    return new EncryptedSftpGet(this, remotePath, localPath);
  }
}
