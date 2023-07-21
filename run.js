import fs from 'fs';
import EncryptedSftp from './src/EncryptedSftp.js';

const sftp = new EncryptedSftp({
  host: process.env.SFTP_HOST,
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD,
});

const publicKeyArmored = fs.readFileSync('keys/public.pgp', 'utf8');
const privateKeyArmored = fs.readFileSync('keys/private.pgp', 'utf8');
await sftp.setKeys(publicKeyArmored, privateKeyArmored);

await sftp.get('writeable/bigfile.txt.gpg', 'dev/test.txt.gpg').decrypt('dev/test.txt').armored();
