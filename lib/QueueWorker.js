
const Shared = require('./Shared.js');
const Queue = require('file-queue').Queue;
const request = require('request');
const fs = require("fs");


(async () => {
    console.log('Starting queue worker ...');
    const cfg = await Shared.OpenclipartConfig.getConfig();

    const processQueue = () => {
        return new Promise((resolve, reject) => {
            queue.length((err, length) => {
                if (length < 1) {
                    console.log('Finished, nothing left to do.');
                    return resolve();
                }
                console.log(`We have ${length} more items.`);
                queue.tpop((err, message, commit, rollback) => {
                    console.log("popped message.", err, message);
                    if (message.action === 'download') {
                        const args = message.args;
                        const tmpto = args.to + '.' + new Date().getTime() + '.tmp';
                        console.log(`we need to download ${args.url} to ${args.to} (via ${tmpto})`);
                        request({
                            url: args.url,
                        }, (error, message, response) => {
                            if (error) {
                                console.log('error downloading file', error);
                                rollback();
                                reject();
                                return;
                            }
                            console.log('Successfully downloaded file.');
                            fs.renameSync(tmpto, args.to);
                            commit();
                            resolve(processQueue());
                        }).pipe(fs.createWriteStream(tmpto));
                    } else {
                        throw new Error(`unknown message ${message.type}`);
                    }
                });
            });
        });
    };

    const queue = new Queue(cfg.paths.queueDir, () => {
        processQueue().then(() => {
            queue.stop();
        });
    });

})().then(() => {
    console.log('finished.');
});

