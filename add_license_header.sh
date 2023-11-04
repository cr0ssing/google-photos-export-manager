#!/bin/bash

# Copyright (C) 2023 Robin Lamberti.

# This file is part of google-photos-export-manager.

# google-photos-export-manager is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# google-photos-export-manager is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with google-photos-export-manager. If not, see <http://www.gnu.org/licenses/>.



for i in $(find ./src -name '*.ts') # or whatever other pattern...
do
  if ! grep -q Copyright $i
  then
    cat copyright_header.txt $i >$i.new && mv $i.new $i
  fi
done
