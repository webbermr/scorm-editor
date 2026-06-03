// Generate a valid imsmanifest.xml for SCORM 1.2 or SCORM 2004.

import { esc } from './serializeHtml';
import type { Course, ScormVersion } from '@/types/course';

export interface SlideResource {
  itemId: string;
  resId: string;
  title: string;
  href: string;
  files: string[];
}

export function buildManifest(course: Course, version: ScormVersion, slideRes: SlideResource[]): string {
  const orgId = 'ORG-' + (course.meta.identifier || 'COURSE');
  const manifestId = course.meta.identifier || 'MANIFEST-COURSE';
  const score = course.meta.passingScore;

  const items = slideRes
    .map((r) => {
      const mastery =
        version === '1.2'
          ? `\n        <adlcp:masteryscore>${score}</adlcp:masteryscore>`
          : `\n        <imsss:sequencing><imsss:objectives><imsss:primaryObjective objectiveID="PRIMARY" satisfiedByMeasure="true"><imsss:minNormalizedMeasure>${(score / 100).toFixed(2)}</imsss:minNormalizedMeasure></imsss:primaryObjective></imsss:objectives></imsss:sequencing>`;
      return `      <item identifier="${esc(r.itemId)}" identifierref="${esc(r.resId)}" isvisible="true">
        <title>${esc(r.title)}</title>${mastery}
      </item>`;
    })
    .join('\n');

  const resources = slideRes
    .map((r) => {
      const scormTypeAttr = version === '1.2' ? `adlcp:scormtype="sco"` : `adlcp:scormType="sco"`;
      const files = r.files.map((f) => `        <file href="${esc(f)}" />`).join('\n');
      return `    <resource identifier="${esc(r.resId)}" type="webcontent" ${scormTypeAttr} href="${esc(r.href)}">
${files}
    </resource>`;
    })
    .join('\n');

  if (version === '1.2') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${esc(manifestId)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${esc(orgId)}">
    <organization identifier="${esc(orgId)}">
      <title>${esc(course.meta.title)}</title>
${items}
    </organization>
  </organizations>
  <resources>
${resources}
  </resources>
</manifest>
`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${esc(manifestId)}" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="${esc(orgId)}">
    <organization identifier="${esc(orgId)}">
      <title>${esc(course.meta.title)}</title>
${items}
    </organization>
  </organizations>
  <resources>
${resources}
  </resources>
</manifest>
`;
}
