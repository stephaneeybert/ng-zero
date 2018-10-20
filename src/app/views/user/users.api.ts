import { User } from '../user/user';
import { PaginationApi } from '../../core/service/pagination.api';

export class UsersApi extends PaginationApi {

    constructor(users: User[], currentPageNumber: number, elementsPerPage: number, totalElements: number, totalPages: number) {
        super(currentPageNumber, elementsPerPage, totalElements, totalPages);
        this.users = users;
    }

    users: User[];

}
