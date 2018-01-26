import * as utils from '../utils';

import { AbstractWidget } from './AbstractWidget';
import { G } from '../tags';

export class Compound extends AbstractWidget {

  parseAndDraw() {
    const g = new G({
      id: this.id,
      class: 'compound',
      'data-name': this.name,
    });
    const elementsNode = utils.findChild(this.node, 'Elements');
    const elementNodes = utils.findChildren(elementsNode);
    this.display.drawElements(g, elementNodes);

    return g;
  }

  updateProperty(property: string, value: any, acquisitionStatus: string, monitoringResult: string) {
    console.warn('Unsupported dynamic property: ' + property);
  }
}
