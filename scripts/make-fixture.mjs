// Generates a small but real SCORM 2004 package used to verify import/export
// end-to-end. Writes to public/test-scorm.zip (loadable by the app via the
// ?demo-import dev hook) and src/scorm/fixtures/test-scorm.zip.

import JSZip from 'jszip';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// A tiny 4x3 PNG (solid violet) — base64.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAFElEQVR4nGNkYPjPgAcw4ZMcVtIAyVwBETx7Yb0AAAAASUVORK5CYII=';
const png = Buffer.from(PNG_BASE64, 'base64');

const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="COURSE-FIXTURE-1" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>Fire Safety Basics</title>
      <item identifier="ITEM-1" identifierref="RES-1"><title>Welcome</title>
        <imsss:sequencing><imsss:objectives><imsss:primaryObjective objectiveID="P" satisfiedByMeasure="true"><imsss:minNormalizedMeasure>0.75</imsss:minNormalizedMeasure></imsss:primaryObjective></imsss:objectives></imsss:sequencing>
      </item>
      <item identifier="ITEM-2" identifierref="RES-2"><title>Know Your Exits</title></item>
      <item identifier="ITEM-3" identifierref="RES-3"><title>Extinguisher Types</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormType="sco" href="content/welcome.html">
      <file href="content/welcome.html" />
    </resource>
    <resource identifier="RES-2" type="webcontent" adlcp:scormType="sco" href="content/exits.html">
      <file href="content/exits.html" />
      <file href="content/img/diagram.png" />
    </resource>
    <resource identifier="RES-3" type="webcontent" adlcp:scormType="sco" href="content/extinguishers.html">
      <file href="content/extinguishers.html" />
    </resource>
  </resources>
</manifest>
`;

const welcome = `<!DOCTYPE html><html><head><title>Welcome</title></head><body>
<h1>Fire Safety Basics</h1>
<p>This short module covers what to do before, during, and after a fire in the workplace.</p>
<blockquote>Knowing your nearest exit saves seconds — and seconds save lives.</blockquote>
</body></html>`;

const exits = `<!DOCTYPE html><html><head><title>Know Your Exits</title></head><body>
<h1>Know Your Exits</h1>
<p>Every floor has at least two marked exits. Walk your route now so it is automatic later.</p>
<ul><li>Locate the two nearest exits</li><li>Note the assembly point outside</li><li>Never use elevators during a fire</li></ul>
<figure><img src="img/diagram.png" alt="Floor exit diagram" /><figcaption>Primary and secondary exit routes.</figcaption></figure>
</body></html>`;

// Includes a non-decomposable table → should become a flagged rawHtml block.
const extinguishers = `<!DOCTYPE html><html><head><title>Extinguisher Types</title></head><body>
<h1>Extinguisher Types</h1>
<p>Match the extinguisher to the fire class before acting.</p>
<table border="1"><thead><tr><th>Class</th><th>Use on</th></tr></thead>
<tbody><tr><td>A</td><td>Wood, paper, cloth</td></tr><tr><td>B</td><td>Flammable liquids</td></tr><tr><td>C</td><td>Electrical</td></tr></tbody></table>
</body></html>`;

const zip = new JSZip();
zip.file('imsmanifest.xml', manifest);
zip.file('content/welcome.html', welcome);
zip.file('content/exits.html', exits);
zip.file('content/extinguishers.html', extinguishers);
zip.file('content/img/diagram.png', png);

const blob = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

mkdirSync(join(root, 'public'), { recursive: true });
mkdirSync(join(root, 'src/scorm/fixtures'), { recursive: true });
writeFileSync(join(root, 'public/test-scorm.zip'), blob);
writeFileSync(join(root, 'src/scorm/fixtures/test-scorm.zip'), blob);

console.log(`Wrote test-scorm.zip (${(blob.length / 1024).toFixed(1)} KB) to public/ and src/scorm/fixtures/`);
