/**
 * Punto de entrada del bundle para la Beta (JS plano en el navegador). Infraestructura: solo compone y re-exporta.
 * La UI llama a `quoteService` con el reloj y los datos del MockRepository; nunca a funciones internas del motor.
 */
import { createQuoteCalculator } from '../modules/calculation'
import { createQuoteService } from '../modules/quoting'

const calculator = createQuoteCalculator()

export const quoteService = createQuoteService({ calculator })
export const supportedCalculationVersions = calculator.supportedVersions()

export {
  customerQuoteText,
  formatClp,
  migrateLegacyCustomerQuote,
  taxLabel,
  CUSTOMER_QUOTE_KEYS,
} from '../modules/customer-quote'
export {
  DEFAULT_CHANNELS,
  failureMessage,
  FLAG_TEXT,
  PREVIEW_ID,
  QUOTE_EXTRAS,
  TAX_REGIME_NOTICE,
  toRawForm,
} from '../modules/quoting'
