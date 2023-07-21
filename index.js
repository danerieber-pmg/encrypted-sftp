'use strict';
const openpgp = require('openpgp');
const Client = require('ssh2-sftp-client');
const { PassThrough } = require('stream');
const { readFile } = require('fs/promises');

const remotePath = 'writeable/file.txt.gpg'
const config = {
    host: process.env.SFTP_HOST,
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD
}

async function decrypt(stream) {
    const privateKeyArmored = await readFile('./private.pgp', 'utf8');
    const passphrase = '1234';
    const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyArmored }),
        passphrase
    });
    const message = await openpgp.readMessage({
        armoredMessage: stream
    });
    const decrypted = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey
    });
    return decrypted.data;
}

async function downloadFile() {
    const sftp = new Client();
    const pipeline = new PassThrough({ encoding: 'utf8' });

    await sftp.connect(config);
    await sftp.get(remotePath, pipeline);

    const decrypted = await decrypt(pipeline);
    for await (const chunk of decrypted) {
        console.log(chunk);
    }
}

(async () => {
    await downloadFile();
})();