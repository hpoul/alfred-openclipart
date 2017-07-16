
const Shared = require('./Shared.js');
const Queue = require('file-queue').Queue;
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
                        if (fs.existsSync(args.to)) {
                            console.log('file has been downloaded in the meantime. skipping. ${args.url}');
                            resolve(processQueue());
                            return;
                        }
                        cfg.downloadFile(args.url, args.to)
                            .then(() => {
                                commit();
                                resolve(processQueue());
                            })
                            .catch((error) => {
                                console.log('error downloading file', error);
                                rollback();
                                reject();
                            });
                    } else {
                        throw new Error(`unknown message ${message.action}`);
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

