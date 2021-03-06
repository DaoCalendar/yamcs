package org.yamcs.xtceproc;

import java.nio.BufferOverflowException;
import java.nio.BufferUnderflowException;
import java.util.Set;
import java.util.SortedSet;

import org.yamcs.ContainerExtractionResult;
import org.yamcs.logging.Log;
import org.yamcs.utils.BitBuffer;
import org.yamcs.xtce.MatchCriteria;
import org.yamcs.xtce.ParameterEntry;
import org.yamcs.xtce.RateInStream;
import org.yamcs.xtce.SequenceContainer;
import org.yamcs.xtce.SequenceEntry;
import org.yamcs.xtceproc.ContainerProcessingContext.ContainerProcessingResult;

public class SequenceContainerProcessor {
    ContainerProcessingContext pcontext;
    private Log log;

    SequenceContainerProcessor(ContainerProcessingContext pcontext) {
        log = new Log(this.getClass(), pcontext.getProcessorData().getYamcsInstance());
        this.pcontext = pcontext;
    }

    public void extract(SequenceContainer seq) {
        ContainerProcessingResult result = pcontext.result;
        BitBuffer buf = pcontext.buffer;
        // First add it to the result
        result.containers.add(new ContainerExtractionResult(seq, buf.array(),
                buf.getPosition() + buf.offset() * 8, result.acquisitionTime, result.generationTime));

        RateInStream ris = seq.getRateInStream();
        if ((ris != null) && ris.getMaxInterval() > 0) {
            result.expireMillis = (long) (pcontext.options.getExpirationTolerance() * ris.getMaxInterval());
        }
        int maxposition = buf.getPosition();

        // then extract the entries
        SortedSet<SequenceEntry> entries = pcontext.subscription.getEntries(seq);
        if (entries != null) {
            for (SequenceEntry se : entries) {
                try {

                    if (se.getIncludeCondition() != null
                            && !se.getIncludeCondition().isMet(pcontext.criteriaEvaluator)) {
                        continue;
                    }

                    switch (se.getReferenceLocation()) {
                    case previousEntry:
                        buf.setPosition(buf.getPosition() + se.getLocationInContainerInBits());
                        break;
                    case containerStart:
                        buf.setPosition(se.getLocationInContainerInBits());
                    }

                    if (pcontext.options.ignoreOutOfContainerEntries() && (buf.getPosition() >= buf.sizeInBits())) {
                        // the next entry is outside of the packet
                        break;
                    }

                    if (se.getRepeatEntry() == null) {
                        pcontext.sequenceEntryProcessor.extract(se);
                    } else { // this entry is repeated several times
                        Long l = pcontext.valueProcessor.getValue(se.getRepeatEntry().getCount());
                        if (l == null) {
                            log.warn("Cannot find value for count {} required for extracting the repeated entry {} ",
                                    se.getRepeatEntry().getCount(), se);
                        } else {
                            long n = l;
                            for (int i = 0; i < n; i++) {
                                pcontext.sequenceEntryProcessor.extract(se);
                                buf.setPosition(buf.getPosition() + se.getRepeatEntry().getOffsetSizeInBits());
                            }
                        }
                    }
                } catch (BufferUnderflowException | BufferOverflowException | IndexOutOfBoundsException e) {
                    if (se instanceof ParameterEntry) {
                        ParameterEntry pe = (ParameterEntry) se;
                        log.warn("Could not extract parameter " + pe.getParameter().getQualifiedName()
                                + "from container " + se.getContainer().getQualifiedName() +
                                " at position " + buf.getPosition()
                                + " because it falls beyond the end of the container. Container size in bits: "
                                + buf.sizeInBits());
                    } else {
                        log.warn("Could not extract entry " + se + "of size "
                                + buf.sizeInBits() + "bits from container " + se.getContainer().getQualifiedName() +
                                " position " + buf.getPosition()
                                + "because it falls beyond the end of the container. Container size in bits: "
                                + buf.sizeInBits());
                    }

                    break;
                }
                if (buf.getPosition() > maxposition) {
                    maxposition = buf.getPosition();
                }
            }
        }

        Set<SequenceContainer> inheritingContainers = pcontext.subscription.getInheritingContainers(seq);
        boolean hasDerived = false;
        if (inheritingContainers != null) {
            // And then any derived containers
            int bitp = buf.getPosition();
            for (SequenceContainer sc : inheritingContainers) {
                MatchCriteria mc = sc.getRestrictionCriteria();
                if (mc == null || mc.isMet(pcontext.criteriaEvaluator)) {
                    hasDerived = true;
                    buf.setPosition(bitp);
                    extract(sc);
                    if (buf.getPosition() > maxposition) {
                        maxposition = buf.getPosition();
                    }
                }
            }
        }
        buf.setPosition(maxposition);
        // Finaly update the stats. We add the packet into the statistics only if it doesn't have a derived container
        if (!hasDerived && (result.stats != null)) {
            String pname = result.getPacketName();
            result.stats.newPacket(pname, (entries == null) ? 0 : entries.size(),
                    result.acquisitionTime, result.generationTime, buf.sizeInBits());
        }
    }
}
