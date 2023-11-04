declare module 'ffmetadata' {
	function read(path: string, cb: (err: Error, data: any) => void): void;

	function read(
		path: string,
		options: { dryRun?: boolean; coverPath?: string },
		cb: (err: Error, data: any) => void
	): void;

	function write(
		path: string,
		data: Record<string, unknown>,
		cb: (err: Error) => void
	): void;

	function write(
		path: string,
		data: Record<string, unknown>,
		options: {
			attachments?: string[];
			dryRun?: boolean;
			coverPath?: string;
			id3v1?: boolean;
			'id3v2.3'?: boolean;
		},

		cb: (err: Error) => void
	): void;

	function setFfmpegPath(path: string): void;
}
