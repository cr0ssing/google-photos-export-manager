/*
 * Copyright (C) 2023 Robin Lamberti.
 *
 * This file is part of google-photos-export-manager.
 *
 * google-photos-export-manager is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * google-photos-export-manager is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with google-photos-export-manager. If not, see <http://www.gnu.org/licenses/>.
 */
import * as piexifts from 'piexif-ts';

type InterimTags = {
  [key in keyof typeof piexifts.TagValues]?: {[key: number]: string}
};

const interimTags: InterimTags = {};
let i: keyof typeof piexifts.TagValues;
for (i in piexifts.TagValues) {
  interimTags[i] = {};
  const root = piexifts.TagValues[i];
  for (const j of Object.keys(root)) {
    interimTags[i]![root[j as keyof typeof root]] = j;
  }
}

export type Tags = {
  [key in keyof piexifts.IExif]: {[key: number]: string}
}

export const tags: Tags = {
  '0th': interimTags.ImageIFD,
  '1st': interimTags.ImageIFD,
  Exif: interimTags.ExifIFD,
  GPS: interimTags.GPSIFD,
  Interop: interimTags.InteropIFD,
};

// Given a Piexifjs object, this function displays its Exif tags
// in a human-readable format
// source: https://auth0-com.cdn.ampproject.org/v/s/auth0.com/blog/amp/read-edit-exif-metadata-in-photos-with-javascript
export function debugExif(exif: piexifts.IExif) {
  let ifd: keyof typeof exif;
  for (ifd in exif) {
    const root: piexifts.IExifElement = exif[ifd]!;
    if (ifd == 'thumbnail') {
      const thumbnailData = root === null ? "null" : root;
      //console.log(`- thumbnail: ${thumbnailData}`);
    } else {
      console.log(`- ${ifd}`);
      // let tag: keyof typeof root;
      for (const tag in root) {
        console.log(`    - ${tags[ifd]![+tag]}: ${root[tag]}`);
      }
    }
  }
}
