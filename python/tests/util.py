from typing import Callable, List, Optional, Sequence, Type
import time


def raise_multiple(errors: List) -> None:
    """
    Raise a stack of errors.
    """
    if len(errors) == 0: return

    try: raise errors.pop()
    finally: raise_multiple(errors)


def is_rate_limited(error: BaseException) -> bool:
    """
    Whether FR24 answered 429: shared CI runners trip its rate limit, and a
    pause is all that fixes it.
    """
    response = getattr(error, "response", None)
    return getattr(response, "status_code", None) == 429 or "429" in str(error).split(":")[0]


def repeat_test(
    attempts: int,
    after: int,
    errors: Optional[Sequence[Type[BaseException]]] = None,
    retry_on: Optional[Callable[[BaseException], bool]] = is_rate_limited,
) -> Callable:
    """
    Decorator to repeat a test N times for specific errors.

    :param attempts: Number of attempts for testing
    :param after: Time in seconds to wait for each attempt
    :param errors: Sequence of exception classes to retry on; if None, retry on any error
    :param retry_on: Predicate that also marks an error as retryable, whatever its class
    """
    if errors is not None:
        invalid = [e for e in errors if not (isinstance(e, type) and issubclass(e, BaseException))]
        if invalid:
            raise TypeError(f"errors must contain exception classes, got: {invalid}")

    def _repeat_test(test_function: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            error_list: List[Exception] = list()

            for _ in range(attempts):
                try:
                    return test_function(*args, **kwargs)

                except Exception as error:
                    retryable = errors is None or isinstance(error, tuple(errors))
                    if not retryable and retry_on is not None: retryable = retry_on(error)
                    if not retryable: raise error
                    if after is not None: time.sleep(after)

                    error_list.append(error)

            raise_multiple(error_list)
        return wrapper
    return _repeat_test
