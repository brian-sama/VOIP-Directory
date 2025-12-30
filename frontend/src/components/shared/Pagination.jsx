
import React from 'react';
import { Pagination as BSPagination } from 'react-bootstrap';

const Pagination = ({ itemsPerPage, totalItems, paginate, currentPage }) => {
    const pageNumbers = [];

    for (let i = 1; i <= Math.ceil(totalItems / itemsPerPage); i++) {
        pageNumbers.push(i);
    }

    if (pageNumbers.length <= 1) return null;

    return (
        <BSPagination className="justify-content-center mt-3">
            <BSPagination.First onClick={() => paginate(1)} disabled={currentPage === 1} />
            <BSPagination.Prev onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} />

            {pageNumbers.map(number => {
                // Show limited range for large datasets (simplified logic: current +/- 2)
                if (
                    number === 1 ||
                    number === pageNumbers.length ||
                    (number >= currentPage - 2 && number <= currentPage + 2)
                ) {
                    return (
                        <BSPagination.Item
                            key={number}
                            active={number === currentPage}
                            onClick={() => paginate(number)}
                        >
                            {number}
                        </BSPagination.Item>
                    );
                } else if (number === currentPage - 3 || number === currentPage + 3) {
                    return <BSPagination.Ellipsis key={number} />;
                }
                return null;
            })}

            <BSPagination.Next onClick={() => paginate(currentPage + 1)} disabled={currentPage === pageNumbers.length} />
            <BSPagination.Last onClick={() => paginate(pageNumbers.length)} disabled={currentPage === pageNumbers.length} />
        </BSPagination>
    );
};

export default Pagination;
