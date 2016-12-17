/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


/**
 * Extract i18n messages from source code
 */
// Must be imported first, because angular2 decorators throws on load.
import 'reflect-metadata';

import * as compiler from '@angular/compiler';
import * as tsc from '@angular/tsc-wrapped';
import * as path from 'path';
import * as ts from 'typescript';

import {CompilerHost, CompilerHostContext, ModuleResolutionHostAdapter} from './compiler_host';
import {PathMappedCompilerHost} from './path_mapped_compiler_host';

export class Extractor {
  constructor(
      private options: tsc.AngularCompilerOptions, private ngExtractor: compiler.Extractor,
      public host: ts.CompilerHost, private ngCompilerHost: CompilerHost,
      private program: ts.Program) {}

  extract(formatName: string): Promise<void> {
    // Checks the format and returns the extension
    const ext = this.getExtension(formatName);

    const files = this.program.getSourceFiles().map(
        sf => this.ngCompilerHost.getCanonicalFileName(sf.fileName));

    const promiseBundle = this.ngExtractor.extract(files);

    return promiseBundle.then(bundle => {
      const content = this.serialize(bundle, ext);
      const dstPath = path.join(this.options.genDir, `messages.${ext}`);
      this.host.writeFile(dstPath, content, false);
    });
  }

  serialize(bundle: compiler.MessageBundle, ext: string): string {
    let serializer: compiler.Serializer;

    switch (ext) {
      case 'xmb':
        serializer = new compiler.Xmb();
        break;
      case 'xlf':
      default:
        serializer = new compiler.Xliff();
    }

    return bundle.write(serializer);
  }

  getExtension(formatName: string): string {
    const format = (formatName || 'xlf').toLowerCase();

    if (format === 'xmb') return 'xmb';
    if (format === 'xlf' || format === 'xlif') return 'xlf';

    throw new Error('Unsupported format "${formatName}"');
  }

  static create(
      options: tsc.AngularCompilerOptions, program: ts.Program, tsCompilerHost: ts.CompilerHost,
      compilerHostContext?: CompilerHostContext, ngCompilerHost?: CompilerHost): Extractor {
    if (!ngCompilerHost) {
      const usePathMapping = !!options.rootDirs && options.rootDirs.length > 0;
      const context = compilerHostContext || new ModuleResolutionHostAdapter(tsCompilerHost);
      ngCompilerHost = usePathMapping ? new PathMappedCompilerHost(program, options, context) :
                                        new CompilerHost(program, options, context);
    }

    const {extractor: ngExtractor} = compiler.Extractor.create(ngCompilerHost);

    return new Extractor(options, ngExtractor, tsCompilerHost, ngCompilerHost, program);
  }
}
