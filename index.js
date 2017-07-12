const alfy = require('alfy');
const fs = require("fs");
const Queue = require('file-queue').Queue;
const child_process = require('child_process');
const path = require('path');

const Shared = require('./lib/Shared.js');


class OpenclipartSearcher {

    constructor(cfg, queue) {
        this.cfg = cfg;
        this.queue = queue;
        this.requireAsyncDownload = false;
    }

    getThumbnailOrQueue(clipart) {
        const thumbnail = this.cfg.paths.thumbnailDir + '/' + clipart.id + '.png';
        if (fs.existsSync(thumbnail)) {
            return thumbnail;
        }
        this.requireAsyncDownload = true;
        this.queue.push({action: 'download', args: { url: clipart.svg.png_thumb, to: thumbnail }}, () => {
            // done.
        });
        return null;
    }

    fetchCliparts(query) {
        this.cfg.log('running query.');
        return alfy.fetch(`https://openclipart.org/search/json/?query=${query}`, {maxAge: 60 * 1000}).then(data => {
            const items = data.payload
                .map(x => ({
                    title: x.title,
                    subtitle: x.description,
                    arg: x.detail_link,
                    icon: {path: this.getThumbnailOrQueue(x)},
                    quicklookurl: x.detail_link,
                }));

            const output = {items: items};

            if (this.requireAsyncDownload) {
                output.rerun = 1;
                this.cfg.log('We need to fork child.');

                const out = fs.openSync('./out.log', 'a');
                const err = fs.openSync('./out.log', 'a');

                const child = child_process.fork(__dirname+path.sep+'lib'+path.sep+'QueueWorker.js', [], {
                    detached: true,
                    stdio: [ 'ignore', out, err, 'ipc' ],
                });
                this.cfg.log('forked child.');
                child.disconnect();
                child.unref();
            }

            console.log(JSON.stringify(output, null, '\t'));

        });
    }

    fetchClipartsForAlfredQuery() {
        return this.fetchCliparts(alfy.input);
    }
}

(async () => {
    const cfg = await Shared.OpenclipartConfig.getConfig();

    const queue = new Queue(cfg.paths.queueDir, () => {
        cfg.log('Setup done.');
        return new OpenclipartSearcher(cfg, queue).fetchClipartsForAlfredQuery().then(() => {
            cfg.log('All done.');
            queue.stop();
        });
    });

})().then(() => {

});


