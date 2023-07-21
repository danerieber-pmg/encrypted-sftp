import fs from 'fs';
import EncryptedSftp from './src/EncryptedSftp.js';

const sftp = new EncryptedSftp({
  host: process.env.SFTP_HOST,
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD,
  publicKeyArmored: fs.readFileSync('keys/public.pgp', 'utf8'),
  privateKeyArmored: fs.readFileSync('keys/private.pgp', 'utf8'),
});

await sftp.put('dev/file.txt', 'writeable/file.txt.pgp');
await sftp.get('writeable/file.txt.pgp', 'dev/file2.txt');
